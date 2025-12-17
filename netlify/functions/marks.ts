import type { Config, Context } from "@netlify/functions";
import { importPKCS8, SignJWT } from "jose";
import wretch from "wretch";
import wretchFormUrlAddon from "wretch/addons/formUrl";

const googleOauthUrl = "https://oauth2.googleapis.com/token";

function mapRowData(dataRow: string[], titleRow: string[]) {
  const courseIndex = titleRow.findIndex((t) => /^course/i.test(t));
  const feeIndex = titleRow.findIndex((t) => /^fee/i.test(t));
  const nameIndex = titleRow.findIndex((t) => /name$/i.test(t));
  const semesterIndex = titleRow.findIndex((t) => /year/i.test(t));
  const subjectIndices: number[] = [];

  for (const [indexOfTitle, title] of titleRow.entries()) {
    if (title.length === 0) {
      subjectIndices.push(indexOfTitle - 1);
    }
  }

  /*
    subjectIndices would be something like [6, 8, 10, 12...]
    i would be [0, 1, 2, 3...]
    
    when i = 0:
      dataRow[subjectIndices[0]] -> dataRow[6] (correct for internal)
      dataRow[subjectIndices[i + 1]] -> dataRow[subjectIndices[0 + 1]] ->
      dataRow[subjectIndices[1]] -> dataRow[8] (incorrect value for external
      as it's the value of internal for next subject), instead:
      
      dataRow[subjectIndices[i + 1] - 1] -> dataRow[subjectIndices[0 + 1] - 1] ->
      dataRow[subjectIndices[1] - 1] -> dataRow[8 - 1] -> dataRow[7] (correct for external)
      
    when i is last (assume 8 for array length 9),
      dataRow[subjectIndices[i + 1] - 1] -> dataRow[subjectIndices[8 + 1] - 1] ->
      dataRow[subjectIndices[9] + 1] -> dataRow[undefined + 1] -> dataRow[NaN] -> undefined, instead:
      
      dataRow[subjectIndices[i] + 1] -> dataRow[subjectIndices[8] + 1] ->
      dataRow[(last item from subjectIndices) + 1] (correct for external)
  */

  return {
    course: dataRow[courseIndex],
    fees: dataRow[feeIndex].toLowerCase() === "y",
    name: dataRow[nameIndex],
    semester: dataRow[semesterIndex],
    subjects: subjectIndices
      .map((si) => titleRow[si])
      .map((s, i) => {
        const data: {
          external: number;
          internal: number;
          name: string;
        } = {
          external: 0,
          internal: parseInt(dataRow[subjectIndices[i]], 10),
          name: s,
        };

        if (i === subjectIndices.length - 1) {
          data.external = parseInt(dataRow[subjectIndices[i] + 1], 10);
        } else {
          data.external = parseInt(dataRow[subjectIndices[i + 1] - 1], 10);
        }
        return data;
      }),
  };
}

export default async function (_: Request, context: Context) {
  const key = await importPKCS8(Netlify.env.get("GOOGLE_PRIVATE_KEY") as string, "RS256");
  const now = Math.floor(Date.now() / 1000);

  const jwt = await new SignJWT({
    aud: googleOauthUrl,
    exp: now + 3600,
    iat: now,
    iss: Netlify.env.get("GOOGLE_CLIENT_EMAIL"),
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
  })
    .setProtectedHeader({
      alg: "RS256",
      typ: "JWT",
    })
    .sign(key);

  const token = await wretch(googleOauthUrl)
    .addon(wretchFormUrlAddon)
    .formUrl({
      assertion: jwt,
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    })
    .post()
    .json<{
      access_token: string;
    }>();

  const wretchGoogleSheet = wretch(
    "https://sheets.googleapis.com/v4/spreadsheets/1xIMK-96S5WnbEx4YR-LSTJZjhzadhp3kJ6W7IaNdz94",
  ).auth(`Bearer ${token.access_token}`);

  const workbook = await wretchGoogleSheet.get().json<{
    sheets: {
      properties: {
        sheetId: string;
        title: string;
      };
    }[];
  }>();

  let dataRow: string[] = [];
  let titleRow: string[] = [];

  for (const sheet of workbook.sheets) {
    const rows = await wretchGoogleSheet
      .get(`/values/${sheet.properties.title}`)
      .json<{
        values: string[][];
      }>();

    for (const row of rows.values) {
      const rowItemsTrimmed = row.map((r) => r.trim());

      if (
        rowItemsTrimmed.includes(
          context.url.searchParams.get("enrollment_number") || "0",
        )
      ) {
        dataRow = rowItemsTrimmed;
      } else if (rowItemsTrimmed.some((r) => /^enroll?ment\s*no\.$/i.test(r))) {
        titleRow = rowItemsTrimmed;
      }
    }

    if (dataRow.length > 0) {
      break;
    }
  }

  const data = mapRowData(dataRow, titleRow);

  if (data.fees) {
    return Response.json(data);
  } else {
    return new Response(null, {
      status: 402,
    });
  }
}

export const config: Config = {
  path: "/marks",
};

      .map((si) => titleRow[si])
      .map((s, i) => {
        const data: {
          external: number
          internal: number

        if (i === subjectIndices.length - 1) {
          data.external = parseInt(dataRow[subjectIndices[i] + 1], 10)
        } else {
          data.external = parseInt(dataRow[subjectIndices[i + 1] - 2], 10)
        }

        data.total = data.external + data.internal
        return data
      })
  }
<script setup lang="ts">
import {
  type FormResolverOptions,
  type FormSubmitEvent,
  Form as PVForm
} from '@primevue/forms'
import PVButton from 'primevue/button'
import PVColumn from 'primevue/column'
import PVDataTable from 'primevue/datatable'
import PVFloatLabel from 'primevue/floatlabel'
import PVInputText from 'primevue/inputtext'
import PVMessage from 'primevue/message'
import PVToast from 'primevue/toast'
import { useToast } from 'primevue/usetoast'
import { computed, reactive, ref } from 'vue'
import wretch from 'wretch'
import wretchQueryString from 'wretch/addons/queryString'
import logo from './assets/logo.jpg'

const currentResult = ref<string>('')
const initialValues = reactive({
  enrollment_number: ''
})

const marks = ref<null | {
  course: string
  fees: boolean
  name: string
  semester: string
  subjects: {
    external: number
    internal: number
    name: string
  }[]
}>(null)

const marksObtained = computed(() => {
  if (!marks.value) {
    return null
  }

  return marks.value.subjects.reduce((val, sub1) => {
    return val + sub1.external + sub1.internal
  }, 0)
})

const marksTotal = computed(() => {
  if (!marks.value) {
    return null
  }

  return marks.value.subjects.length * 100
})

const percentage = computed(() => {
  if (!marksObtained.value || !marksTotal.value) {
    return null
  }

  return (marksObtained.value / marksTotal.value) * 100
})

const result = computed(() => {
  if (!marks.value || !percentage.value) {
    return null
  }

  if (
    percentage.value < 40 ||
    marks.value.subjects.some((m) => m.external < 24 || m.internal < 16)
  ) {
    return 'Fail'
  } else {
    return 'Pass'
  }
})

const submitting = ref<boolean>(false)
const toast = useToast()

function resolver(e: FormResolverOptions) {
  const errors = {
    enrollment_number: [
      {
        message: ''
      }
    ]
  }

  if (!e.values.enrollment_number) {
    errors.enrollment_number = [
      {
        message: 'Enrollment Number is required'
      }
    ]

    return {
      errors
    }
  }

  if (!/^\d{11}$/.test(e.values.enrollment_number.trim())) {
    errors.enrollment_number = [
      {
        message: 'Invalid Enrollment Number'
      }
    ]

    return {
      errors
    }
  }
}

async function handleSubmit(e: FormSubmitEvent) {
  if (!e.valid) {
    return
  }

  if (currentResult.value === e.values.enrollment_number) {
    return
  }

  try {
    submitting.value = true
    marks.value = await wretch('/marks')
      .addon(wretchQueryString)
      .query({
        enrollment_number: e.values.enrollment_number
      })
      .get()
      .error(402, () => {})
      .error(404, () => {
        toast.add({
          detail: 'No records found for the provided Enrollment Number.',
          life: 3000,
          severity: 'error',
          summary: 'Error'
        })
      })
      .json<typeof marks.value>()
    currentResult.value = e.values.enrollment_number
  } catch (e) {
    const error = e as Error

    if ('status' in error) {
      if (error.status === 402) {
        toast.add({
          detail:
            'Fees not paid. Please clear your dues to check your results.',
          life: 3000,
          severity: 'error',
          summary: 'Error'
        })
      } else if (error.status === 404) {
        toast.add({
          detail: 'No records found for the provided Enrollment Number.',
          life: 3000,
          severity: 'error',
          summary: 'Error'
        })
      } else {
        toast.add({
          detail:
            'An unexpected server error occurred. Please try again later.',
          life: 3000,
          severity: 'error',
          summary: 'Error'
        })
      }
    } else {
      toast.add({
        detail: 'An unexpected error occurred. Please try again later.',
        life: 3000,
        severity: 'error',
        summary: 'Error'
      })
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <PVToast/>
  <div class="flex flex-col items-center justify-center">
    <img v-bind:src="logo" width="384"/>
    <h1 class="m-0 m-t-3">IIAM College, Kalyan :: Results Portal</h1>
    <PVForm class="m-t-12" validateOnSubmit v-bind:initialValues v-bind:resolver v-bind:validateOnValueUpdate="false" v-on:submit="handleSubmit" v-slot="$form">
      <PVFloatLabel>
        <PVInputText fluid id="enrollment_number" name="enrollment_number"/>
        <label for="enrollment_number">Enrollment Number</label>
      </PVFloatLabel>
      <PVMessage severity="error" size="small" v-if="$form.enrollment_number?.invalid" variant="simple">{{ $form.enrollment_number.error.message }}</PVMessage>
      <PVButton class="m-t-3" label="Submit" severity="secondary" type="submit" v-bind:loading="submitting"/>
    </PVForm>
    <div class="m-t-12" v-if="marks && !submitting">
      <h2 class="m-0 text-center">{{ marks.name }}</h2>
      <h3 class="m-0 text-center">{{ marks.course }} ({{ marks.semester }})</h3>
      <PVDataTable class="border-rounded-1.5 m-t-3 overflow-hidden" v-bind:value="marks.subjects">
        <PVColumn field="name" header="Subject"/>
        <PVColumn field="internal" header="Internal">
          <template v-slot:body="slotProps">
            <p v-bind:class="`m-0 text-center ${slotProps.data.internal < 16 ? 'text-red-500' : ''}`">{{ slotProps.data.internal }}</p>
          </template>
        </PVColumn>
        <PVColumn field="external" header="External">
          <template v-slot:body="slotProps">
            <p v-bind:class="`m-0 text-center ${slotProps.data.external < 24 ? 'text-red-500' : ''}`">{{ slotProps.data.external }}</p>
          </template>
        </PVColumn>
        <template v-slot:footer>
          <div>
            <p class="m-0">Marks obtained: {{ marksObtained }}</p>
            <p class="m-0">Maximum marks: {{ marksTotal }}</p>
            <p class="m-0">Percentage: {{ percentage }}%</p>
            <p class="m-0">Result: {{ result }}</p>
          </div>
        </template>
      </PVDataTable>
    </div>
  </div>
</template>

<style>
  .border-rounded-1\.5 {
    border-radius: 0.375rem;
  }

  .box-border {
    box-sizing: border-box;
  }
  
  .flex {
    display: flex;
  }
  
  .flex-col {
    flex-direction: column;
  }
  
  .font-600 {
    font-weight: 600;
  }
  
  .font-inter {
    font-family: "Inter", sans-serif;
  }
  
  .items-center {
    align-items: center;
  }
  
  .justify-center {
    justify-content: center;
  }
  
  .m-0 {
    margin: 0;
  }
  
  .m-t-3 {
    margin-top: 0.75rem;
  }
  
  .m-t-12 {
    margin-top: 3rem;
  }
  
  .overflow-hidden {
    overflow: hidden;
  }
  
  .p-6 {
    padding: 1.5rem;
  }
  
  .text-center {
    text-align: center;
  }
  
  .text-red-500 {
    color: #fb2c36;
  }
</style>

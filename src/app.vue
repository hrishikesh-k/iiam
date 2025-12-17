<script setup lang="ts">
  import PVButton from 'primevue/button'
  import PVColumn from 'primevue/column'
  import PVDataTable from 'primevue/datatable'
  import { Form as PVForm, type FormResolverOptions, type FormSubmitEvent } from '@primevue/forms'
  import PVFloatLabel from 'primevue/floatlabel'
  import PVMessage from 'primevue/message'
  import PVInputText from 'primevue/inputtext'
  import PVToast from 'primevue/toast'
  import { reactive, ref } from 'vue'
  import { useToast } from 'primevue/usetoast'
  import wretch from 'wretch'
  import wretchQueryString from 'wretch/addons/queryString'
  
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
      errors.enrollment_number = [{
        message: 'Enrollment Number is required'
      }]
      
      return {
        errors
      }
    }
    
    if (!/^\d{11}$/.test(e.values.enrollment_number.trim())) {
      errors.enrollment_number = [{
        message: 'Invalid Enrollment Number'
      }]
      
      return {
        errors
      }
    }
  }
  
  async function handleSubmit(e: FormSubmitEvent) {
    if (!e.valid) {
      return
    }

    marks.value =await wretch('/marks')
      .addon(wretchQueryString)
      .query({
        enrollment_number: e.values.enrollment_number
      })
      .get()
      .error(402, () => {
        toast.add({
          detail: 'Fees not paid. Please clear your dues to check your results.',
          life: 3000,
          severity: 'error',
          summary: 'Error'
        })
      })
      .error(404, () => {
        toast.add({
          detail: 'No records found for the provided Enrollment Number.',
          life: 3000,
          severity: 'error',
          summary: 'Error'
        })
      })
      .json<typeof marks.value>()
      .catch(() => {
        toast.add({
          detail: 'An unexpected error occurred. Please try again later.',
          life: 3000,
          severity: 'error',
          summary: 'Error'
        })
      })
  }
</script>

<template>
  <PVToast/>
  <PVForm v-bind:initialValues v-bind:resolver v-on:submit="handleSubmit" v-slot="$form">
    <PVFloatLabel>
      <PVInputText id="enrollment_number" name="enrollment_number"/>
      <label for="enrollment_number">Enrollment Number</label>
    </PVFloatLabel>
    <PVMessage severity="error" size="small" v-if="$form.enrollment_number?.invalid" variant="simple">{{ $form.enrollment_number.error.message }}</PVMessage>
    <PVButton label="Submit" severity="secondary" type="submit"/>
  </PVForm>
  <PVDataTable v-if="marks" v-bind:value="marks.subjects">
    <PVColumn field="name" header="Subject"/>
    <PVColumn field="internal" header="Internal Marks (out of 40)"/>
    <PVColumn field="external" header="External Marks (out of 60)"/>
  </PVDataTable>
</template>

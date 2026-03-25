import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qmqkutlouhhnkwdplcvl.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtcWt1dGxvdWhobmt3ZHBsY3ZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNzM2MDgsImV4cCI6MjA4Njg0OTYwOH0.x48kXsw-Uyd-9p-YdsI8orMfFw6eDIBIe7aaYlqcNMA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)


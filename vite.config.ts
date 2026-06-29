import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const resolveBasePath = () => {
  const configuredBasePath = process.env.VITE_BASE_PATH?.trim()
  if (!configuredBasePath) {
    return '/'
  }

  if (configuredBasePath === '/') {
    return '/'
  }

  const withLeadingSlash = configuredBasePath.startsWith('/')
    ? configuredBasePath
    : `/${configuredBasePath}`

  return withLeadingSlash.endsWith('/')
    ? withLeadingSlash
    : `${withLeadingSlash}/`
}

export default defineConfig({
  base: resolveBasePath(),
  plugins: [react()],
})

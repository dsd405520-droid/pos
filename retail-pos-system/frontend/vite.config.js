import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // ອະນຸຍາດໃຫ້ເຂົ້າເຖິງຈາກເຄື່ອງອື່ນໃນເຄືອຂ່າຍ (LAN)
    proxy: {
      '/api': 'http://localhost:5001',
      '/uploads': 'http://localhost:5001',
    },
  },
})

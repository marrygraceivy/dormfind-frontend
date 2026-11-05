import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()], base:'./', server:{proxy:{'/api':{target: process.env.VITE_PROXY_TARGET || 'https://dormfind.onrender.com',changeOrigin:true}}}, build:{outDir:'dist'}});


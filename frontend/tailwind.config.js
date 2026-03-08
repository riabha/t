/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#eff6ff',
                    100: '#dbeafe',
                    200: '#bfdbfe',
                    300: '#93c5fd',
                    400: '#60a5fa',
                    500: '#3b82f6',
                    600: '#2563eb',
                    700: '#1d4ed8',
                    800: '#1e40af',
                    900: '#1e3a8a',
                    950: '#172554',
                },
                dark: {
                    700: '#1e293b',
                    800: '#0f172a',
                    900: '#020617',
                },
                brand: {
                    navy: '#0A1628',
                    deep: '#0F1D35',
                    gold: '#D4A843',
                    amber: '#F2C94C',
                    teal: '#06B6D4',
                    emerald: '#10B981',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                display: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
            },
            animation: {
                'float': 'float 6s ease-in-out infinite',
                'float-slow': 'float 8s ease-in-out infinite',
                'float-delay': 'float 7s ease-in-out 2s infinite',
                'shimmer': 'shimmer 2.5s ease-in-out infinite',
                'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
                'fade-in-up-delay': 'fadeInUp 0.8s ease-out 0.2s forwards',
                'fade-in-up-delay2': 'fadeInUp 0.8s ease-out 0.4s forwards',
                'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
                'spin-slow': 'spin 12s linear infinite',
                'count-up': 'countUp 2s ease-out forwards',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-20px)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
                fadeInUp: {
                    '0%': { opacity: '0', transform: 'translateY(30px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                pulseGlow: {
                    '0%, 100%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.15)' },
                    '50%': { boxShadow: '0 0 40px rgba(59, 130, 246, 0.3)' },
                },
                countUp: {
                    '0%': { opacity: '0', transform: 'scale(0.5)' },
                    '60%': { transform: 'scale(1.1)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
            },
        },
    },
    plugins: [],
}

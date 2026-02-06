/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: '#3B82F6',
                success: '#22C55E',
                lime: '#32CD32',
                warning: '#F59E0B',
                error: '#EF4444',
                background: '#0F172A',
                surface: '#1E293B',
                border: '#334155',
                text: '#F8FAFC',
                textSecondary: '#94A3B8',
            }
        },
    },
    plugins: [],
}

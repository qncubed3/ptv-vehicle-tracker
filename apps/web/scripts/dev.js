// Starts the Next.js dev server with system TLS certificates on Windows.
process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ''} --use-system-ca`.trim()

const { spawn } = require('child_process')

const child = spawn('next', ['dev'], {
    stdio: 'inherit',
    shell: true,
    env: process.env
})

child.on('exit', (code) => {
    process.exit(code ?? 0)
})

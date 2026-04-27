import { spawn } from 'child_process'

export const spawnAsync = (command: string, args: string[], options: Parameters<typeof spawn>[2]): Promise<number> => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options)
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(code)
      }
      const errorMessage = code ? `Process exited with code ${code.toString()}` : 'Process exited with no code'
      reject(new Error(errorMessage))
    })
  })
}

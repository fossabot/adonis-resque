import { ApplicationService } from '@adonisjs/core/types'
import { Queue, ResqueConfig } from '../types.js'
import { importAllJobs } from '../jobs.js'
import { BaseCommand } from '@adonisjs/core/ace'
import { createQueue } from '../queue.js'

declare module '@adonisjs/core/types' {
    interface ContainerBindings {
      queue: Queue
    }
}

export default class ResqueProvider {
    command?: BaseCommand
    constructor(protected app: ApplicationService) {
    }

    register() {
        this.app.container.singleton('queue', async () => {
            const jobs = await importAllJobs()
            const queue = await createQueue(jobs)
            await queue.connect()
            return queue
        })
    }

    async start() {
        const { runWorkerInWebEnv } = this.app.config.get<ResqueConfig>('resque')
        if (this.app.getEnvironment() === 'web' && runWorkerInWebEnv) {
            const ace = await this.app.container.make('ace')
            await ace.boot()
            if (ace.getCommand('resque:start')) {
                this.command = await ace.exec('resque:start', [])
                if (this.command.exitCode !== 0 || this.command.error) {
                    const error = this.command.error || new Error(`Failed to start command resque:start`)
                    throw error
                }
            }
        }
    }

    async shutdown() {
        if (this.command) {
            await this.command.terminate()
        }
        const queue = await this.app.container.make('queue')
        await queue.end()
    }
}

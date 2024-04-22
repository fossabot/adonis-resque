
<div align="center">
  <img src="https://i.imgur.com/SWHLZNO.png" />
  <h3>Node Resque Queue for AdonisJS v6</h3>
  <p>A third-party wrapper for `node-resque` in AdonisJS v6.</p>
  <a href="https://www.npmjs.com/package/adonis-resque"><img src="https://img.shields.io/npm/v/adonis-resque?logo=nodedotjs" /></a>
  <img src="https://img.shields.io/badge/Lang-typescript-blue?logo=typescript" />
  <img src="https://img.shields.io/npm/l/adonis-resque?logo=opensourceinitiative" />
</div>

> [!CAUTION]
> This package is not compatible with AdonisJS v5.

<!-- TOC -->

- [Introduction](#introduction)
- [Installation](#installation)
- [Folders](#folders)
- [Job Usage](#job-usage)
  - [Basic](#basic)
  - [Batch enqueue](#batch-enqueue)
  - [Delayed enqueue](#delayed-enqueue)
  - [Repeated Enqueue](#repeated-enqueue)
- [Node-Resque Plugin](#node-resque-plugin)
  - [Plugin.jobLock](#pluginjoblock)
  - [Plugin.queueLock](#pluginqueuelock)
  - [Plugin.delayQueueLock](#plugindelayqueuelock)
  - [Plugin.retry](#pluginretry)
  - [Plugin.noop](#pluginnoop)
  - [Custom Your Own Plugin](#custom-your-own-plugin)
- [Handle Failure Jobs](#handle-failure-jobs)
- [Failure Event](#failure-event)
- [Demonstration](#demonstration)
  - [Send Mail Job](#send-mail-job)
- [Configuration](#configuration)
- [Web UI](#web-ui)
- [Notice for the graceful exit](#notice-for-the-graceful-exit)
- [Reference](#reference)
- [Lisence](#lisence)

<!-- /TOC -->
<!-- /TOC -->
<!-- /TOC -->

<!-- /TOC -->
<!-- /TOC -->

## Introduction
`adonis-resque` add the queue ability to adonis base on node-resque. Resque is a background job system backed by Redis.

## Installation

```bash
node ace add adonis-resque
```
> [!IMPORTANT]
> `adonis-redis` is required for resque redis connection.
> 
## Folders

Jobs default place in folder `app/jobs`.
You can import the job by sub-path.
```typescript
import Example from #jobs/example
```

> [!TIP]
> Please follow this instruction: [The sub-path imports](https://docs.adonisjs.com/guides/folder-structure#the-sub-path-imports).
> 
> Both `package.json` and `tsconfig.json` are required to add the job path:
> - add to `package.json`
>  ```json
>  "#jobs/*": "./app/jobs/*.js"
>  ```
> - add to field `compilerOptions.paths` in `tsconfig.json`
>  ```json
>  "#jobs/*": ["./app/jobs/*.js"]
>  ```


## Job Usage
You can create a resque job by adonis command: `node ace make:job <YourJobName>`

### Basic

Create a basic example job: `node ace make:job BasicExample`.
Every job has a perform method. It runs in the background, which consumer from the node-resque queue.

```typescript
import { BaseJob } from 'adonis-resque'
export default class BasicExample extends BaseJob {
  async perform(name: string) {
    this.logger.info(`Hello ${name}`)
  }
}
```

Now you can enqueue this job. 
```typescript
import BasicExample from '#jobs/basic_example'
await BasicExample.enqueue('Bob')
```

Console would print `Hello Bob`.

> [!WARNING]
> Make sure your Job ClassName is unique in the queue. and argument of method perform would be jsonify to redis.

### Batch enqueue
```typescript
await BasicExample.enqueueAll([
  ['Alice'],
  ['Bob'],
  ['Carol'],
  ['Dave'],
  ['Eve']
])
```

### Delayed enqueue
```typescript
const oneSecondLater = 1000
await BasicExample.enqueue('Bob').in(oneSecondLater)
```
Or enqueue at a specify timestamp
```typescript
const fiveSecondsLater = new Date().getTime() + 5000
await BasicExample.enqueue('Bob').at(fiveSecondsLater)
```

### Repeated Enqueue

class Job has the schedule properties.
- `interval`, .e.g `5s`, `15m`, `2h` and `1d`. [package ms](https://github.com/vercel/ms) for more details.
- `cron`, for cron syntax, look up the [croner package](https://github.com/hexagon/croner)

The example below enqueue in both every 1 second and 5 minutes, since it's `cron`/`interval` settings.

```typescript
export default class BasicExample extends BaseJob {
  // enqueue job cronly
  cron: '*/1 * * * * *',
  // enqueue every five minutes
  interval: '5m',
  async perform(name: string) {
    this.logger.log(`Hello ${name}`)
  }
}
```

> [!TIP]
> You can and should run multi process schedules.
> Not all schedules will enquene the cron job,
> only the leader do, even in the different machines.  
> For more informations, see node-resque leader scheduler: https://github.com/actionhero/node-resque?tab=readme-ov-file#job-schedules

## Node-Resque Plugin

Adonis-resque encapsulated the default node-resque plugins in a smooth way, with the better typing support.

The default node-resque plugins are:

- `Retry`
- `JobLock`
- `Retry`
- `QueueLock`
- `DelayQueueLock`
- `Noop`

You can adding them to the `plugins` property of your job class, by `Plugin.<PluginName>({...pluginOptions})`

### Plugin.jobLock

JobLock plugin is used to prevent a job to be performed (hook in `beforePerform`), which has the same name, queue and args is already running.

If reEnqueue is `true`, the job will be put back (re-enqueue) with a delay <enqueueTimeout>.

```typescript
import { BaseJob, Plugin } from "adonis-resque"

export default class ExampleJob extends BaseJob {
    plugins = [
        Plugin.jobLock({ reEnqueue: false, enqueueTimeout: 3000 })
    ]
    async perform() {
        this.logger.info('Example job started')
        await sleep(60000)
        this.logger.info('Example job done')
    }
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Plugin.queueLock

Similar to jobLock, but it would be prevented before enqueue.
If a job with the same name, queue, and args is already in the queue, do not enqueue it again.

QueueLock Options:

```typescript
export interface QueueLockOptions {
    /**
     * in seconds
     */
    lockTimeout?: number
    key?: LockKey
}
```
### Plugin.delayQueueLock

Same as queueLock, but it is for the delay queue.


### Plugin.retry

If a job fails, retry it <retryLimit> times before finally placing it into the failed queue
You can specify the retryDelay option to delay, or set the backoffStrategy to the delay ms array.
Note:
It will retry by key, composed of queueName, jobName and args.
Not retry by the enqueuing action.

```typescript
import { BaseJob, Plugin } from "adonis-resque"

export default class ExampleJob extends BaseJob {
    plugins = [
        Plugin.retry({
            retryLimit: 3,
            backoffStrategy: [1000, 3000, 8000]
        })
    ]
    async perform() {
        const res = await fetch(`https://dummyjson.com/products/1`)
        this.logger.info(`Response status is ${res.status}`)
    }
}
```

### Plugin.noop

you can customize the error logger by option `logger`

### Custom Your Own Plugin

You can create your own plugin by extending the `BasePlugin` class,
it also implements the `Plugin` abstract class from `node-resque`.
See more details in [node-resque plugins](https://github.com/actionhero/node-resque?tab=readme-ov-file#plugins).

```typescript
import { BasePlugin } from "adonis-resque"
export default class MyPlugin extends BasePlugin {
    /**
     * Plugin options here
     * with default values
     */
    options = {
        foo: 'bar'
    }
    async beforeEnqueue() {
    }
    async afterEnqueue() {
    }
    async beforePerform(){
    }
    async afterPerform() {
    }
}
```

Now you can use it in your job class:
```typescript
import { BaseJob } from "adonis-resque"
// import MyPlugin from './my-plugin'

class ExampleJob extends BaseJob {
    plugins = [
        MyPlugin.create({ foo: 'baz' })
    ]
}
```

## Handle Failure Jobs

You can handle failure jobs by defining a `onFailure` method to your job class.
Once a job fails, before it is moved to the `failed` queue, this method will be called.

```typescript
import { BaseJob, type ResqueFailure } from 'adonis-resque'
class Job extends BaseJob {
      async onFailure(failure: ResqueFailure) {
        console.log('resque job failured:', failure)
    }
}
```

The ResqueFailure interface is:

```typescript
export interface ResqueFailure {
    // Only the failure emitted by MultiWorker has a workerId
    workerId?: number
    queue: string
    job: NodeResqueJob
    failure: Error
    duration: number
}
```

> [!TIPS]
> If you are using `retry` plugin, the `onFailure` method will be called only if the job has exceeded the retry limit.

## Failure Event

Another way to handle failure jobs is to listen to the `resque:failure` event.

go `start/events.ts` to handle.
```typescript
import emitter from '@adonisjs/core/services/emitter'

emitter.on('resque:failure', (failure) => {
    console.error('resque:failure', failure)
})
```

## Demonstration
### Send Mail Job

In Adonis Documentation, they use bullmq as mail queueing example.
But if we wanna use `adonis-resque` for `mail.sendLater`, how to do?

1. Create a Mail Job  
Run `node ace make:job Mail` to create the mail job, then edit it in `app/jobs/mail.ts`

```typescript
import { BaseJob } from 'adonis-resque'
import mail from '@adonisjs/mail/services/main'
import { MessageBodyTemplates, NodeMailerMessage } from '@adonisjs/mail/types'

interface Options {
    mailMessage: {
        message: NodeMailerMessage;
        views: MessageBodyTemplates;
    }
    config: any
}
export default class Mail extends BaseJob {
    async perform(option: Options) {
        const { messageId } = await mail.use('smtp')
            .sendCompiled(option.mailMessage, option.config)
        this.logger.info(`Email sent, id is ${messageId}`)
    }
}
```

2. Custom `mail.setMessenger` in a service provider  
You can add the below code snippet to a boot method of any service provider.

```typescript
const mail = await this.app.container.make('mail.manager')
mail.setMessenger(() => {
  return {
    async queue(mailMessage, sendConfig) {
      return Mail.enqueue({ mailMessage, config: sendConfig })
    }
  }
})
```

3. `mail.sendLater` is available now! Try it: :shipit:
```typescript
await mail.sendLater((message) => {
  message.to('your-address@example.com', 'Your Name')
  .subject('Hello from adonis-resque')
  .html(`<strong>Congratulations!</strong>`)
})
```

> [!CAUTION]
> You should insure `@adonisjs/mail` has a correct config, you'd better to test it first.

## Configuration

Here is an example of `config/resque.ts`

```typescript
{
    /**
     * redis connection config from @adonisjs/redis
     */
    redisConnection: 'main',
    /**
     * run web & worker in same process, if enabled
     * You need to run command node ace resque:start if it is turned off
     *
     * it's convenient but NOT Recommanded in production
     * also, DO NOT enable for math-heavy jobs, even in the dev or staging environment.
     * 
     */
    runWorkerInWebEnv: true,
    /**
     * when runScheduler enabled, it starts with worker
     * if you'd like to run scheduler in the separated processes
     * please turn runScheduler off, and run command
     * node ace resque:start --scheduler
     */
    runScheduler: true,
    /**
     * enable node-resque multiworker
     * @docs https://github.com/actionhero/node-resque?tab=readme-ov-file#multi-worker
     */
    isMultiWorkerEnabled: true,
    /**
     * the first argument in MultiWorker constructor
     */
    multiWorkerOption: {
        minTaskProcessors: 1,
        maxTaskProcessors: 10
    },
    /**
     * the argument for Worker constructor, if multiWorker is not enabled
     */
    workerOption: {
    },
    /**
     * the default queue name for jobs to enqueue
     */
    queueNameForJobs: 'default',
    /**
     * queue name for workers to listen,
     * is a string or an array of string
     * setting a proper queue name could change their priorities 
     * e.g. queueNameForWorkers: "high-priority, medium-priority, low-priority"
     * All the jobs in high-priority will be worked before any of the jobs in the other queues. 
     */
    queueNameForWorkers: '*',
    queueNameForWorkers: '*',
    /**
     * set null to use the default logger
     */
    logger: null,
    // verbose mode for debugging
    verbose: true
}
```

## Web UI
node-resque also compatible with some Resque Web UI, .e.g [resque-web](https://github.com/resque/resque-web)

Here is `docker-compose.yml` an example
```yaml
services:
  redis:
    image: redis
  resque-web:
    image: appwrite/resque-web:1.1.0
    ports:
      - "5678:5678"
    environment:
      - RESQUE_WEB_HOST=redis # (OPTIONAL - Use only if different than the default 127.0.0.1)
      - RESQUE_WEB_PORT=6379  # (OPTIONAL - Use only if different the default 6379)
      - RESQUE_WEB_HTTP_BASIC_AUTH_USER= # (OPTIONAL - if not set no password used)
      - RESQUE_WEB_HTTP_BASIC_AUTH_PASSWORD=  # (OPTIONAL - if not set no password used)
    depends_on:
      - redis
    restart: unless-stopped
```

![Web UI](https://i.imgur.com/nN2d9ak.png)

## Notice for the graceful exit
resque require the graceful exit, or schedulers would waiting for a leader election.

node-resque may not exit in dev environment if you exit by `ctrl+c`.
you can change `bin/server.ts`
```typescript
app.listenIf(app.managedByPm2, 'SIGINT', () => app.terminate())
```
to 
```typescript
app.listen('SIGINT', () => app.terminate())
```

if adonis dev server terminated but process still there, you can send SIGTERM signal to all node process(on macOS) `killall node`

You can also check the redis key `resque:resque_scheduler_leader_lock`, which value is scheduler name contains pid of the leader process. it should be release once server terminated.
## Reference

- [node-resque](https://github.com/actionhero/node-resque)

## Lisence
the MIT

# Styleguide (WIP)

This is a simple overview of different conventions we want to follow for commands in the Netlify CLI. This document will
start simple and grow over time.

## Starting your command

Each command starts by using the `intro` method. You can import it like this:

```js
import { intro } from '../../utils/styles/index.js'

export const basicCommand = () => {
  intro('basic command')
  // do stuff
}
```

Pass the name of the command to the `intro` method.

## Finishing your command

Each command should end by using the `outro` method to create a clear visual end for your command. You can import it
like this:

```js
import { intro, outro } from '../../utils/styles/index.js'

export const basicCommand = () => {
  intro('basic command')
  // do stuff
  outro()
}
```

You don't need to call `outro` if your command throws an error, as `NetlifyLog.error()` automatically creates a clear
visual end for your command already.

## Other content

Any content that is logged to the console using `NetlifyLog` between the `intro` and `outro` methods will be visually
grouped together so it is clear that they all belong to the same command.

## Log to the console using `NetlifyLog`

Use our custom logger to log messages to the console. This will ensure that the CLI is consistent in its output and that
we can easily change the output format in the future. To do this, import `NetlifyLog` like this:

```js
import { NetlifyLog } from '../../utils/styles/index.js'
```

### Messages

For a normal message to the console use the `NetlifyLog.message()` method. This will log a clean message.

### Errors

If your command throws an error, it should use the `NetlifyLog.error()` method. This will ensure that the error is
logged to the console and that the CLI exits with a non-zero exit code. When you throw an error you don't have to also
call `outro()`.

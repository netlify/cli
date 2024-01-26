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

### Child commands

As some of our commands call other CLI commands, we will sometimes want to conditionally call `intro` depending on
whether or not the command is a child command. To do this, we use add a property to the `OptionValues` object called
`isChildCommand`. This property should be set to `true` when the command is a child command. This means that we can
conditionally call `intro` like this:

```js
import { intro } from '../../utils/styles/index.js'

export const basicCommand = (options) => {
  !options.isChildCommand && intro('basic command')
  // do stuff
}
```

Doing this ensures the CLI groups the messages together correctly and ensures two `intro` messages are not shown.

## Finishing your command

Each command should end by using the `outro` method to create a clear visual end for your command. You can import it
like this:

```js
import { intro, outro } from '../../utils/styles/index.js'

export const basicCommand = () => {
  intro('basic command')
  // do stuff
  outro({ message: 'Your message', exit: true })
}
```

You don't need to call `outro` if your command throws an error, as `NetlifyLog.error()` automatically creates a clear
visual end for your command already. Outro must be called with an object:
`outro({ exit: true })` and you can pass a message to it with `outro({ exit: true, message: 'Your message' })`.

### Child commands

As some of our commands call other CLI commands, we will sometimes we want to conditionally call `outro` depending
on whether or not the command is a child command. To do this, we use add a property to the `OptionValues` object
called `isChildCommand`. This property should be set to `true` when the command is a child command. This means that we can
conditionally call `outro` like this:

```js
import { intro, outro } from '../../utils/styles/index.js'

export const basicCommand = (options) => {
  !options.isChildCommand && intro('basic command')
  // do stuff
  if (options.isChildCommand) {
    NetlifyLog.success('Your message')
  }
  else {
    outro({ message: 'Your message', exit: true })
  }
}
```

Doing this ensures the CLI groups the messages together correctly and ensures two `outro` messages are not shown.

## Other content

Any content that is logged to the console using `NetlifyLog` between the `intro` and `outro` methods will be visually
grouped together so it is clear that they all belong to the same command.

## Log to the console using `NetlifyLog`

Use our custom logger to log messages to the console. This will ensure that the CLI is consistent in its output and that
we can easily change the output format in the future. To do this, import `NetlifyLog` like this:

```js
import { NetlifyLog } from '../../utils/styles/index.js'
```

Logs work really well together with the `intro` and `outro` methods.

### `NetlifyLog.message()`

If you want to send a simple message to the console that does not need to stand out, use the `NetlifyLog.message()`
method. This will log a normal unstyled message.

### `NetlifyLog.info()`

To log a message that should stand out a bit more, use the `NetlifyLog.info()` method. This will log a message with a
little bit of styling.

### `NetlifyLog.success()`

To log a success message that informs the user that their command was successful, use the `NetlifyLog.success()` method.

### `NetlifyLog.step()`

If your command has multiple steps, you can use the `NetlifyLog.step()` method to log a message that informs the user
which step is currently running.

### `NetlifyLog.warn() and NetlifyLog.warning()`

To log a warning message that informs the user that something might be wrong, use the `NetlifyLog.warn()` or the
`NetlifyLog.warning()` method.

### `NetlifyLog.error()`

If your command throws an error, it should use the `NetlifyLog.error()` method. This will ensure that the error is
logged to the console and that the CLI exits with a non-zero exit code. When you throw an error you don't have to also
call `outro()`.

## Spinner

If your command is doing something that takes a while, you can use the `spinner` method to show a spinner to the user.
The spinner starts off with a message that you can pass to the `spinner` method. You can then update the message of the
spinner by calling `spinner.message()` method again with a new message. When your command is done, you can call the
`spinner` method again with, or without a message to stop the spinner.

```js
import { intro, outro, spinner } from '../../utils/styles/index.js'

export const basicCommand = async () => {
  intro('basic command')
  const loading = spinner()

  loading.start('Doing a thing')
  await doAThing()
  loading.stop('Finished doing a thing')

  outro()
}
```

## Asking for user input

There are several helpers available for asking the user for input. They are all available in the
`'./utils/styles/index.js'` file.

### select

The `select` method allows you to ask the user to select an option from a list of options. You can pass a list of
options to the `select` method and it will return the selected option.

```js
import { select } from '../../utils/styles/index.js'

const result = await select({
  message: 'Select an option',
  maxItems: 7,
  options: list.map((thing) => ({
    label: thing.name,
    value: thing.id,
  })),
})
```

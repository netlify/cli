import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'

export type GlobalConfig = z.output<typeof GlobalConfigSchema>

export const GlobalConfigSchema = z.object(
  {
    cliId: z
      .string({ description: 'An anonymous identifier used for telemetry information.' })
      .optional()
      .default(uuidv4),
    userId: z
      .string({
        description:
          "The current selected user's unique Netlify identifier. Consumers can change this using the `netlify {login,logout,switch}` commands.",
      })
      .optional(),
    telemetryDisabled: z
      .boolean({ description: 'Prevents anonymous telemetry information from being sent to Netlify.' })
      .optional()
      .default(false),
    users: z
      .record(
        z.string({ description: "The user's unique Netlify identifier." }),
        z.object({
          id: z.string({ description: "The user's unique Netlify identifier." }),
          name: z.string({ description: "The user's full name (e.g. Johanna Smith)." }).optional(),
          email: z.string({ description: "The user's email address." }).optional(),
          auth: z
            .object({
              token: z.string({ description: "The user's Netlify API token." }).optional(),
              github: z
                .object(
                  {
                    provider: z
                      .string({
                        description:
                          "The token issuer. This schema is relaxed, but in practice it should always be 'github'.",
                      })
                      .optional(),
                    token: z.string({ description: "The user's GitHub API token." }).optional(),
                    user: z.string({ description: "The user's GitHub username." }).optional(),
                  },
                  {
                    description:
                      "The user's GitHub API credentials issued via the Netlify GitHub App. This is usually set in the `netlify init` flow. When not set, it will be an empty object.",
                  },
                )
                .optional()
                .default(() => ({})),
            })
            .optional()
            .default(() => ({})),
        }),
        {
          description:
            'A store of user profiles available to the consumer. Consumers can specify which profile is used to authenticate commands using `netlify switch` command.',
        },
      )
      .optional()
      .default(() => ({})),
  },
  {
    description:
      "The Netlify CLI's persistent configuration state. This state includes information that should be persisted across CLI invocations, and is stored in the user's platform-specific configuration directory (e.g. `$XDG_CONFIG_HOME/netlify/config.json`, `$HOME/Library/Preferences/netlify/config.json`, etc.).",
  },
)

export const parseGlobalConfig = (
  value: unknown,
): { data: GlobalConfig; error?: never; success: true } | { data?: never; error: Error; success: false } =>
  GlobalConfigSchema.safeParse(value)

export const mustParseGlobalConfig = (value: unknown): GlobalConfig => {
  const result = parseGlobalConfig(value)
  if (!result.success) {
    throw result.error
  }
  return result.data
}

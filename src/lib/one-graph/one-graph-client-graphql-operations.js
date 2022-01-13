const internalOperationsDoc = `mutation CreatePersistedQueryMutation(
    $nfToken: String!
    $appId: String!
    $query: String!
    $tags: [String!]!
    $description: String!
  ) {
    oneGraph(
      auths: { netlifyAuth: { oauthToken: $nfToken } }
    ) {
      createPersistedQuery(
        input: {
          query: $query
          appId: $appId
          tags: $tags
          description: $description
        }
      ) {
        persistedQuery {
          id
        }
      }
    }
  }
  
  query ListPersistedQueries(
      $appId: String!
      $first: Int!
      $after: String
      $tags: [String!]!
    ) {
      oneGraph {
        app(id: $appId) {
          id
          persistedQueries(
            first: $first
            after: $after
            tags: $tags
          ) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              query
              fixedVariables
              freeVariables
              allowedOperationNames
              tags
              description
            }
          }
        }
      }
    }
    
    subscription ListPersistedQueriesSubscription(
      $appId: String!
      $first: Int!
      $after: String
      $tags: [String!]!
    ) {
      poll(
        onlyTriggerWhenPayloadChanged: true
        schedule: { every: { minutes: 1 } }
      ) {
        query {
          oneGraph {
            app(id: $appId) {
              id
              persistedQueries(
                first: $first
                after: $after
                tags: $tags
              ) {
                pageInfo {
                  hasNextPage
                  endCursor
                }
                nodes {
                  id
                  query
                  fixedVariables
                  freeVariables
                  allowedOperationNames
                  tags
                  description
                }
              }
            }
          }
        }
      }
    }
    
    query PersistedQueriesQuery(
      $nfToken: String!
      $appId: String!
    ) {
      oneGraph(
        auths: { netlifyAuth: { oauthToken: $nfToken } }
      ) {
        app(id: $appId) {
          persistedQueries {
            nodes {
              id
              query
              allowedOperationNames
              description
              freeVariables
              fixedVariables
              tags
            }
          }
        }
      }
    }
    
    query PersistedQueryQuery(
      $nfToken: String!
      $appId: String!
      $id: String!
    ) {
      oneGraph(
        auths: { netlifyAuth: { oauthToken: $nfToken } }
      ) {
        persistedQuery(appId: $appId, id: $id) {
          id
          query
          allowedOperationNames
          description
          freeVariables
          fixedVariables
          tags
        }
      }
    }
    
    mutation CreateCLISessionMutation(
      $nfToken: String!
      $appId: String!
      $name: String!
      $metadata: JSON
    ) {
      oneGraph(
        auths: { netlifyAuth: { oauthToken: $nfToken } }
      ) {
        createNetlifyCliSession(
          input: { appId: $appId, name: $name, metadata: metadata }
        ) {
          session {
            id
            appId
            netlifyUserId
            name
          }
        }
      }
    }
    
    mutation UpdateCLISessionMetadataMutation(
      $nfToken: String!
      $sessionId: String!
      $metadata: JSON!
    ) {
      oneGraph(
        auths: { netlifyAuth: { oauthToken: $nfToken } }
      ) {
        updateNetlifyCliSession(
          input: { id: $sessionId, metadata: $metadata }
        ) {
          session {
            id
            name
            metadata
          }
        }
      }
    }
    
    mutation CreateCLISessionEventMutation(
      $nfToken: String!
      $sessionId: String!
      $payload: JSON!
    ) {
      oneGraph(
        auths: { netlifyAuth: { oauthToken: $nfToken } }
      ) {
        createNetlifyCliTestEvent(
          input: {
            data: { payload: $payload }
            sessionId: $sessionId
          }
        ) {
          event {
            id
            createdAt
            sessionId
          }
        }
      }
    }
    
  query CLISessionEventsQuery(
    $nfToken: String!
    $sessionId: String!
    $first: Int!
  ) {
    oneGraph(
      auths: { netlifyAuth: { oauthToken: $nfToken } }
    ) {
      netlifyCliEvents(sessionId: $sessionId, first: $first) {
        __typename
        createdAt
        id
        sessionId
        ... on OneGraphNetlifyCliSessionLogEvent {
          id
          message
          sessionId
          createdAt
        }
        ... on OneGraphNetlifyCliSessionTestEvent {
          id
          createdAt
          payload
          sessionId
        }
      }
    }
  }
    
  mutation AckCLISessionEventMutation(
    $nfToken: String!
    $sessionId: String!
    $eventIds: [String!]!
  ) {
    oneGraph(
      auths: { netlifyAuth: { oauthToken: $nfToken } }
    ) {
      ackNetlifyCliEvents(
        input: { eventIds: $eventIds, sessionId: $sessionId }
      ) {
        events {
          id
        }
      }
    }
  }
  
  query AppSchemaQuery(
    $nfToken: String!
    $appId: String!
  ) {
    oneGraph(
      auths: { netlifyAuth: { oauthToken: $nfToken } }
    ) {
      app(id: $appId) {
        graphQLSchema {
          appId
          createdAt
          id
          services {
            friendlyServiceName
            logoUrl
            service
            slug
            supportsCustomRedirectUri
            supportsCustomServiceAuth
            supportsOauthLogin
          }
          updatedAt
        }
      }
    }
  }
  
  mutation UpsertAppForSiteMutation(
    $nfToken: String!
    $siteId: String!
  ) {
    oneGraph(
      auths: { netlifyAuth: { oauthToken: $nfToken } }
    ) {
      upsertAppForNetlifySite(
        input: { netlifySiteId: $siteId }
      ) {
        org {
          id
          name
        }
        app {
          id
          name
          corsOrigins
          customCorsOrigins {
            friendlyServiceName
            displayName
            encodedValue
          }
        }
      }
    }
  }
  
  mutation CreateNewSchemaMutation(
    $nfToken: String!
    $input: OneGraphCreateGraphQLSchemaInput!
  ) {
    oneGraph(
      auths: { netlifyAuth: { oauthToken: $nfToken } }
    ) {
      createGraphQLSchema(input: $input) {
        app {
          graphQLSchema {
            id
          }
        }
        graphqlSchema {
          id
          services {
            friendlyServiceName
            logoUrl
            service
            slug
            supportsCustomRedirectUri
            supportsCustomServiceAuth
            supportsOauthLogin
          }
        }
      }
    }
  }`

module.exports = {
  internalOperationsDoc,
}

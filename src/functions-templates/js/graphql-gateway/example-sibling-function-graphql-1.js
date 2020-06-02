// not meant to be run inside the graqhql-gateway function
// but just shows a copy-pastable example sibling function
// that would work with graphql-gateway
const { ApolloServer, gql } = require('apollo-server-lambda')

const typeDefs = gql`
  type Query {
    hello: String
    allAuthors: [Author!]
    author(id: Int!): Author
    authorByName(name: String!): Author
  }
  type Author {
    id: ID!
    name: String!
    age: Int!
  }
`

const authors = [
  { id: 1, name: 'Terry Pratchett', age: 67 },
  { id: 2, name: 'Stephen King', age: 71 },
  { id: 3, name: 'JK Rowling', age: 53 },
]

const resolvers = {
  Query: {
    hello: (root, args, context) => {
      return 'Hello, world!'
    },
    allAuthors: (root, args, context) => {
      return authors
    },
    author: (root, args, context) => {
      return
    },
    authorByName: (root, args, context) => {
      return authors.find(x => x.name === args.name) || 'NOTFOUND'
    },
  },
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
})

exports.handler = server.createHandler()

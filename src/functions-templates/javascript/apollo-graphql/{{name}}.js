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
    married: Boolean!
  }
`

const authors = [
  { id: 1, name: 'Terry Pratchett', married: false },
  { id: 2, name: 'Stephen King', married: true },
  { id: 3, name: 'JK Rowling', married: false },
]

const resolvers = {
  Query: {
    hello: () => 'Hello, world!',
    allAuthors: () => authors,
    author: () => {},
    authorByName: (root, args) => {
      console.log('hihhihi', args.name)
      return authors.find((author) => author.name === args.name) || 'NOTFOUND'
    },
  },
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
})

const handler = server.createHandler()

module.exports = { handler }

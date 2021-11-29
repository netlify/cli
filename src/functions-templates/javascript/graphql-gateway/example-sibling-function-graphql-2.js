// not meant to be run inside the graqhql-gateway function
// but just shows a copy-pastable example sibling function
// that would work with graphql-gateway
const { ApolloServer, gql } = require('apollo-server-lambda')

const typeDefs = gql`
  type Query {
    hello: String
    allBooks: [Book]
    book(id: Int!): Book
  }
  type Book {
    id: ID!
    year: Int!
    title: String!
    authorName: String!
  }
`

/* eslint-disable no-magic-numbers */
const books = [
  {
    id: 1,
    title: "The Philosopher's Stone",
    year: 1997,
    authorName: 'JK Rowling',
  },
  {
    id: 2,
    title: 'Pet Sematary',
    year: 1983,
    authorName: 'Stephen King',
  },
  {
    id: 3,
    title: 'Going Postal',
    year: 2004,
    authorName: 'Terry Pratchett',
  },
  {
    id: 4,
    title: 'Small Gods',
    year: 1992,
    authorName: 'Terry Pratchett',
  },
  {
    id: 5,
    title: 'Night Watch',
    year: 2002,
    authorName: 'Terry Pratchett',
  },
  {
    id: 6,
    title: 'The Shining',
    year: 1977,
    authorName: 'Stephen King',
  },
  {
    id: 7,
    title: 'The Deathly Hallows',
    year: 2007,
    authorName: 'JK Rowling',
  },
]
/* eslint-enable no-magic-numbers */

const resolvers = {
  Query: {
    hello: () => 'Hello, world!',
    allBooks: () => books,
    book: (root, args) => books.find((book) => book.id === args.id),
  },
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
})

const handler = server.createHandler()

module.exports = { handler }

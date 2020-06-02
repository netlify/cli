/* eslint-disable */
const { ApolloServer, gql } = require('apollo-server-lambda')
const RandomUser = require('./random-user.js')
// example from: https://medium.com/yld-engineering-blog/easier-graphql-wrappers-for-your-rest-apis-1410b0b5446d

const typeDefs = gql`
  """
  Example Description for Name Type

  It's multiline and you can use **markdown**! [more docs](https://www.apollographql.com/docs/apollo-server/essentials/schema#documentation)!
  """
  type Name {
    "Description for first"
    title: String
    "Description for title"
    first: String
    "Description for last"
    last: String
  }
  type Location {
    street: String
    city: String
    state: String
    postcode: String
  }
  type Picture {
    large: String
    medium: String
    thumbnail: String
  }
  type User {
    gender: String
    name: Name
    location: Location
    email: String
    phone: String
    cell: String
    picture: Picture
    nat: String
  }
  type Query {
    """
    Example Description for getUser

    It's multiline and you can use **markdown**!
    """
    getUser(gender: String): User
    getUsers(people: Int, gender: String): [User]
  }
`
const resolvers = {
  Query: {
    getUser: async (_, { gender }, { dataSources }) => dataSources.RandomUser.getUser(gender),
    getUsers: async (_, { people, gender }, { dataSources }) => dataSources.RandomUser.getUsers(people, gender),
  },
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
  dataSources: () => ({
    RandomUser: new RandomUser(),
  }),
})

exports.handler = server.createHandler()

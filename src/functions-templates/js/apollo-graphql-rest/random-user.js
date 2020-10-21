const { RESTDataSource } = require('apollo-datasource-rest')

class RandomUser extends RESTDataSource {
  constructor() {
    super()
    this.baseURL = 'https://randomuser.me/api'
  }

  async getUser(gender = DEFAULT_GENDER) {
    const user = await this.get(`/?gender=${gender}`)
    return user.results[0]
  }

  async getUsers(people = DEFAULT_PEOPLE_COUNT, gender = DEFAULT_GENDER) {
    const user = await this.get(`/?results=${people}&gender=${gender}`)
    return user.results
  }
}

const DEFAULT_PEOPLE_COUNT = 10
const DEFAULT_GENDER = 'all'

module.exports = RandomUser

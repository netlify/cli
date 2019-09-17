const { RESTDataSource } = require('apollo-datasource-rest')

class RandomUser extends RESTDataSource {
  constructor() {
    super()
    this.baseURL = 'https://randomuser.me/api'
  }

  async getUser(gender = 'all') {
    const user = await this.get(`/?gender=${gender}`)
    return user.results[0]
  }

  async getUsers(people = 10, gender = 'all') {
    const user = await this.get(`/?results=${people}&gender=${gender}`)
    return user.results
  }
}

module.exports = RandomUser

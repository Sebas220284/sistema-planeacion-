class User {
  constructor(id, name, email, password, role, dependency_id) {
    this.id = id
    this.name = name
    this.email = email
    this.password = password
    this.role = role
    this.dependency_id = dependency_id
  }
}

module.exports = User
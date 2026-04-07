class SaveTrimestre {
  constructor(repository) {
    this.repository = repository
  }

  async execute(data) {
    return await this.repository.saveTrimestre(data)
  }
}

module.exports = SaveTrimestre
class ReviewTrimestre{

constructor(repository){

this.repository = repository

}

async execute(data){

return await this.repository.reviewTrimestre(data)

}

}

module.exports = ReviewTrimestre
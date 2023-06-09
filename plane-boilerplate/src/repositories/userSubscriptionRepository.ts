import { DataSource, MongoRepository } from "typeorm";
import UserSubscription from "../models/userSubscription.js";
import dbConnection from "./connection.js";
import { Service } from "typedi";
import baseRepository from "./baseRepository.js";
@Service()
export default class UserSubscriptionRepository extends baseRepository<UserSubscription> {
  constructor() {
    super()
    this.connection = dbConnection;
    this.repository = this.connection.getMongoRepository(UserSubscription);
  }
}

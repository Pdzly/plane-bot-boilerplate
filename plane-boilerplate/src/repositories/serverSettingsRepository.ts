import { DataSource, MongoRepository } from "typeorm";
import UserSubscription from "../models/userSubscription.js";
import dbConnection from "./connection.js";
import { Service } from "typedi";
import ServerSettings from "../models/serverSettings.js";
import baseRepository from "./baseRepository.js";
@Service()
export default class serverSettingsRepository extends baseRepository<ServerSettings> {

  constructor() {
    super()
    this.connection = dbConnection;
    this.repository = this.connection.getMongoRepository(ServerSettings);
  }
}

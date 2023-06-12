import { DataSource, MongoRepository } from "typeorm";
import UserSubscription from "../models/userSubscription.js";
import dbConnection from "./connection.js";
import { Service } from "typedi";
@Service()
export default class UserSubscriptionRepository {
  connection: DataSource;
  repository: MongoRepository<UserSubscription>;
  constructor() {
    this.connection = dbConnection;
    this.repository = this.connection.getMongoRepository(UserSubscription);
  }
  async getUserSubscriptions() {
    const userSubscriptions = this.repository.find();
    return userSubscriptions;
  }

  async getUserSubscriptionByIssueId(issueId: number) {
    issueId = Number(issueId);
    console.log(issueId);
    const userSubscription = await this.repository.find({
      where: {
        issueId: {$eq: issueId},
      }
    });
    return userSubscription;
  }

  async getUserSubscription(userId: string, issueId: number) {
    const userSubscription = await this.repository.findOne({
      where: {
        userId: {$eq: userId},
        issueId: {$eq: issueId},
      },
    });
    return userSubscription;
  }
  async createUserSubscription(userId: string, issueId: number) {
    const userSubscription = new UserSubscription();
    userSubscription.userId = userId;
    userSubscription.issueId = issueId;
    await this.repository.save(userSubscription);
    return userSubscription;
  }
  async deleteUserSubscription(userId: string, issueId: number) {
    const userSubscription = await this.getUserSubscription(userId, issueId);
    if (userSubscription) {
      await this.connection
        .getRepository(UserSubscription)
        .delete(userSubscription);
    }
  }
}

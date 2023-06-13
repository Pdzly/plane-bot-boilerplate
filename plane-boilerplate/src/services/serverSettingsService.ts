import { Inject, Service } from "typedi";
import serverSettingsRepository from "../repositories/serverSettingsRepository.js";

@Service()
export default class serverSettingsService {
  @Inject()
  serverSettingsRepository: serverSettingsRepository;
  async setAuthRole(guild: string, role: string){
    let serverSettings = await this.serverSettingsRepository.findOne({where: {serverId: guild}})
    if(!serverSettings){
      serverSettings = this.serverSettingsRepository.create()
      serverSettings.serverId = guild
    }
    serverSettings.verificationRoleId = role
    return await this.serverSettingsRepository.save(serverSettings)
  }
  async getAuthRole(guild: string){
    let serverSettings = await this.serverSettingsRepository.findOne({where: {serverId: guild}})
    if(!serverSettings){
      serverSettings = this.serverSettingsRepository.create()
      serverSettings.serverId = guild
    }
    await this.serverSettingsRepository.save(serverSettings)

    return serverSettings.verificationRoleId
  }
}

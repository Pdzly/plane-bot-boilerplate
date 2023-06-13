import { Entity, ObjectId, ObjectIdColumn, Column } from "typeorm"
import 'reflect-metadata';

@Entity()
export default class ServerSettings {
    @ObjectIdColumn()
    _id!: ObjectId;
    @Column()
    serverId: string;
    @Column()
    verificationRoleId?: string;
}
import { Entity, ObjectId, ObjectIdColumn, Column } from "typeorm"
import 'reflect-metadata';

export interface UserSubscriptionSettings {
    deleteOnClose?: boolean;
}

@Entity()
export default class UserSubscription {
    @ObjectIdColumn()
    _id!: ObjectId;
    @Column()
    userId: string;
    @Column()
    issueId: number;
    @Column()
    settings: UserSubscriptionSettings
}
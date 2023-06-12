import { Entity, ObjectId, ObjectIdColumn, Column } from "typeorm"
import 'reflect-metadata';

@Entity()
export default class UserSubscription {
    @ObjectIdColumn()
    _id!: ObjectId;
    @Column()
    userId: string;
    @Column()
    issueId: number;
}
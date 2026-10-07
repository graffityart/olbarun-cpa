import {pgTable,uuid,varchar,text,timestamp,index} from 'drizzle-orm/pg-core';
import {users} from './core';
export const customerNotices=pgTable('customer_notices',{
 id:uuid('id').defaultRandom().primaryKey(),title:varchar('title',{length:160}).notNull(),content:text('content').notNull(),authorUserId:uuid('author_user_id').notNull().references(()=>users.id),createdAt:timestamp('created_at',{withTimezone:true}).defaultNow().notNull()
},table=>({createdAtIdx:index('customer_notices_created_at_idx').on(table.createdAt)}));

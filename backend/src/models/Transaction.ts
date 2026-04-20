import { HydratedDocument, InferSchemaType, Model, Schema, Types, model, models } from "mongoose";

const transactionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["credit", "debit", "hold", "release", "purchase", "sale"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  },
);

export type Transaction = Omit<InferSchemaType<typeof transactionSchema>, "userId"> & {
  userId: Types.ObjectId;
};
export type TransactionDocument = HydratedDocument<Transaction>;
type TransactionModel = Model<Transaction>;

export const TransactionModel =
  (models.Transaction as TransactionModel | undefined) ??
  model<Transaction>("Transaction", transactionSchema);

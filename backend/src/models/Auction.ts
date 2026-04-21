import { HydratedDocument, InferSchemaType, Model, Schema, Types, model, models } from "mongoose";

const auctionSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    images: {
      type: [String],
      required: true,
      default: [],
    },
    startingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    currentBid: {
      type: Number,
      required: true,
      min: 0,
    },
    bidCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "processing", "sold", "expired", "cancelled"],
      required: true,
      default: "active",
    },
    winnerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    endsAt: {
      type: Date,
      required: true,
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

auctionSchema.index({ status: 1, endsAt: 1 });

export type Auction = Omit<InferSchemaType<typeof auctionSchema>, "sellerId"> & {
  sellerId: Types.ObjectId;
};
export type AuctionDocument = HydratedDocument<Auction>;
type AuctionModel = Model<Auction>;

export const AuctionModel =
  (models.Auction as AuctionModel | undefined) ?? model<Auction>("Auction", auctionSchema);

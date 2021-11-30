"use strict";

const { MoleculerClientError } = require("moleculer").Errors;

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const DbService = require("../mixins/db.mixin");
const CacheCleanerMixin = require("../mixins/cache.cleaner.mixin");
// const MongooseAdapter = require("moleculer-db-adapter-mongoose");
const mongoose = require("mongoose");

module.exports = {
	name: "users",
	mixins: [DbService("users"), CacheCleanerMixin(["cache.clean.users"])],
	// adapter: new MongooseAdapter("mongodb://localhost/users"),
	model: mongoose.model(
		"User",
		mongoose.Schema({
			// _id: mongoose.Schema.Types.ObjectId,
			username: { type: String },
			email: { type: String },
			password: { type: Number, default: 0 },
			token: { type: Number, default: 0 },
		})
	),
	afterConnected() {
		this.logger.info("Connected successfully users...");
	},

	/**
	 * Default settings
	 */
	settings: {
		/** REST Basepath */
		rest: "/",
		/** Secret for JWT */
		JWT_SECRET: process.env.JWT_SECRET || "jwt-conduit-secret",

		/** Public fields */
		fields: ["_id", "username", "email", "password", "role"],

		/** Validator schema for entity */
		entityValidator: {
			username: { type: "string", min: 2 },
			password: { type: "string", min: 3 },
			email: { type: "string" },
			role: { type: "string" },
		},
	},

	/**
	 * Actions
	 */
	actions: {
		/**
		 * Register a new user
		 *
		 * @actions
		 * @param {Object} user - User entity
		 *
		 * @returns {Object} Created entity & token
		 */
		list: {
			rest: {
				method: "GET",
				path: "/",
			},
			async handler() {
				return await this.adapter.find({});
			},
		},
		get: {
			rest: {
				method: "GET",
				path: "/:id",
				params: {
					type: "string",
				},
			},
			async handler(ctx) {
				let entity = ctx.params;

				if (entity.id) {
					const found = await this.adapter.findOne({
						_id: entity.id,
					});
					if (found) {
						return found;
					} else {
						throw new MoleculerClientError(
							"Username not found!",
							422,
							"",
							[{ field: "_id", message: "User not found" }]
						);
					}
				}
			},
		},
		create: {
			rest: "POST /users",
			params: {
				user: {
					type: "object",
					props: {
						username: {
							type: "string",
							min: 2,
							optional: false,
							pattern: /^([a-zA-Z0-9 _-]+)$/,
						},
						password: {
							type: "string",
							min: 3,
							optional: false,
						},
						email: { type: "string", optional: false },
						token: { type: "string", optional: true },
					},
				},
			},
			async handler(ctx) {
				let entity = ctx.params.user;
				await this.validateEntity(entity);
				if (entity.username) {
					const found = await this.adapter.findOne({
						username: entity.username,
					});
					if (found)
						throw new MoleculerClientError(
							"Username is exist!",
							422,
							"",
							[{ field: "username", message: "is exist" }]
						);
				}

				if (entity.email) {
					const found = await this.adapter.findOne({
						email: entity.email,
					});
					if (found) {
						throw new MoleculerClientError(
							"Email is exist!",
							422,
							"",
							[{ field: "email", message: "is exist" }]
						);
					}
				}

				entity.password = bcrypt.hashSync(entity.password, 10);
				entity.role = entity.role || null;
				entity.createdAt = new Date();

				const doc = await this.adapter.insert(entity);
				const user = await this.transformDocuments(ctx, {}, doc);
				const json = this.transformEntity(user, true, ctx.meta.token);
				await this.entityChanged("created", json, ctx);
				return json;
			},
		},
		update: {
			rest: "PUT /users/:id",
			params: {
				user: {
					type: "object",
					props: {
						username: {
							type: "string",
							min: 2,
							optional: false,
							pattern: /^([a-zA-Z0-9 _-]+)$/,
						},
						password: {
							type: "string",
							min: 3,
							optional: false,
						},
						email: { type: "email", optional: false },
						token: { type: "string", optional: true },
					},
				},
			},
			async handler(ctx) {
				const newData = ctx.params.user;
				console.log("newData", newData);
				if (newData.id) {
					const found = await this.adapter.findOne({
						_id: newData.id,
					});
					console.log("found", found);
				}
				newData.updatedAt = new Date();
				const update = {
					$set: newData,
				};

				console.log("ctx.meta.user", ctx.params.id);
				const doc = await this.adapter.updateById(
					ctx.params.id,
					update
				);

				const user = await this.transformDocuments(ctx, {}, doc);
				return { user: user };
			},
		},
		remove: {
			rest: {
				method: "DELETE /users/:id",
				path: "/:id",
				params: {
					type: "string",
				},
			},
			async handler(ctx) {
				let entity = ctx.params;

				if (entity.id) {
					const found = await this.adapter.findOne({
						_id: entity.id,
					});
					if (found) {
						await this.adapter.removeById(entity.id);
						return found;
					} else {
						throw new MoleculerClientError(
							"Username not found!",
							422,
							"",
							[{ field: "_id", message: "User not found" }]
						);
					}
				}
			},
		},
	},
	/**
	 * Methods
	 */
	methods: {
		/**
		 * Generate a JWT token from user entity
		 *
		 * @param {Object} user
		 */
		generateJWT(user) {
			const today = new Date();
			const exp = new Date(today);
			exp.setDate(today.getDate() + 60);

			return jwt.sign(
				{
					id: user._id,
					username: user.username,
					exp: Math.floor(exp.getTime() / 1000),
				},
				this.settings.JWT_SECRET
			);
		},

		/**
		 * Transform returned user entity. Generate JWT token if neccessary.
		 *
		 * @param {Object} user
		 * @param {Boolean} withToken
		 */
		transformEntity(user, withToken, token) {
			if (user) {
				if (withToken) user.token = token || this.generateJWT(user);
			}

			return { user };
		},

		/**
		 * Transform returned user entity as profile.
		 *
		 * @param {Context} ctx
		 * @param {Object} user
		 * @param {Object?} loggedInUser
		 */
		async transformProfile(ctx, user, loggedInUser) {
			if (loggedInUser) {
				const res = await ctx.call("follows.has", {
					user: loggedInUser._id.toString(),
					follow: user._id.toString(),
				});
				user.following = res;
			} else {
				user.following = false;
			}

			return { profile: user };
		},
	},
};

"use strict";

const { MoleculerClientError } = require("moleculer").Errors;

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const DbService = require("../mixins/db.mixin");
const CacheCleanerMixin = require("../mixins/cache.cleaner.mixin");
const mongoose = require("mongoose");

module.exports = {
	name: "tokens",
	mixins: [DbService("tokens"), CacheCleanerMixin(["cache.clean.tokens"])],
	model: mongoose.model(
		"Token",
		mongoose.Schema({
			email: { type: String },
			token: String,
		})
	),
	populates: {
		token_id: {
			action: "tokens.get",
			params: {
				fields: ["email"],
			},
		},
	},
	afterConnected() {
		this.logger.info("Connected successfully tokens...");
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
		fields: ["_id", "email", "token"],

		/** Validator schema for entity */
		entityValidator: {
			email: { type: "string" },
			token: { type: "string" },
		},
	},

	/**
	 * Actions
	 */
	actions: {
		/**
		 * Register a new tokens
		 *
		 * @actions
		 * @param {Object} token - Token entity
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
							"Token not found!",
							422,
							"",
							[{ field: "_id", message: "Token not found" }]
						);
					}
				}
			},
		},
		create: {
			rest: {
				method: "POST",
				path: "/tokens",
				params: {
					token: {
						type: "object",
						props: {
							email: { type: "string", optional: false },
							token: { type: "string", optional: true },
						},
					},
				},
			},
			async handler(ctx) {
				let entity = ctx.params;

				const token = jwt.sign(
					{ id: entity.id },
					this.settings.JWT_SECRET,
					{
						expiresIn: 86400, // 24 hours
					}
				);
				const data = { email: entity.email, token: token };
				const doc = await this.adapter.insert(data);

				return doc;
			},
		},
		update: {
			rest: "PUT /tokens/:id",
			params: {
				token: {
					type: "object",
					props: {
						email: { type: "email", optional: false },
						token: { type: "string", optional: true },
					},
				},
			},
			async handler(ctx) {
				const newData = ctx.params.token;

				newData.updatedAt = new Date();
				const update = {
					$set: newData,
				};

				console.log("ctx.meta.token", ctx.params.id);
				const doc = await this.adapter.updateById(
					ctx.params.id,
					update
				);

				const token = await this.transformDocuments(ctx, {}, doc);
				return { token: token };
			},
		},
		remove: {
			rest: {
				method: "DELETE /tokens/:id",
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
							"Token not found!",
							422,
							"",
							[{ field: "_id", message: "Token not found" }]
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
		generateJWT(token) {
			const today = new Date();
			const exp = new Date(today);
			exp.setDate(today.getDate() + 60);

			return jwt.sign(
				{
					id: token._id,
					username: token.username,
					exp: Math.floor(exp.getTime() / 1000),
				},
				this.settings.JWT_SECRET
			);
		},

		/**
		 * Transform returned token entity. Generate JWT token if neccessary.
		 *
		 * @param {Object} user
		 * @param {Boolean} withToken
		 */
		transformEntity(user, withToken, token) {
			if (token) {
				if (withToken) user.token = token || this.generateJWT(user);
			}

			return { token };
		},

		/**
		 * Transform returned token entity as profile.
		 *
		 * @param {Context} ctx
		 * @param {Object} token
		 * @param {Object?} loggedInUser
		 */
		async transformProfile(ctx, token, loggedInUser) {
			if (loggedInUser) {
				const res = await ctx.call("follows.has", {
					token: loggedInUser._id.toString(),
					follow: token._id.toString(),
				});
				token.following = res;
			} else {
				token.following = false;
			}

			return { profile: token };
		},
	},
};

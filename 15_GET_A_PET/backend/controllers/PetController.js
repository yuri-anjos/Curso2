const getToken = require("../helpers/get-token");
const getUserByToken = require("../helpers/get-user-by-token");
const { Pet } = require("../models");
const { isValidObjectId } = require("mongoose");
const fs = require("fs");

module.exports = class PetController {
	static async create(req, res) {
		const { name, age, weigth, color } = req.body;
		const images = req.files;

		if (!name) {
			res.status(422).json({ message: "O NOME é obrigatório!" });
			return;
		}

		if (!age) {
			res.status(422).json({ message: "A IDADE é obrigatória!" });
			return;
		}

		if (!weigth) {
			res.status(422).json({ message: "O PESO é obrigatório!" });
			return;
		}

		if (!color) {
			res.status(422).json({ message: "A COR é obrigatória!" });
			return;
		}

		if (!images.length) {
			res.status(422).json({ message: "As IMAGENS são obrigatórias!" });
			return;
		}

		const token = getToken(req);
		const petOwner = await getUserByToken(token);

		const pet = new Pet({
			name,
			age,
			weigth,
			color,
			available: true,
			refused: [],
			images: images.map((image) => {
				return { data: image.buffer, contentType: image.mimetype };
			}),
			user: {
				_id: petOwner._id,
				name: petOwner.name,
				image: petOwner.image,
				phone: petOwner.phone,
			},
		});

		try {
			const newPet = await pet.save();
			res.status(201).json({
				message: "Pet cadastrado com sucesso!",
				pet: newPet,
			});
		} catch (error) {
			res.status(500).json({ message: "Erro inesperado!", error });
			console.error("Error: " + error);
		}
	}

	static async getAll(req, res) {
		const pets = await Pet.find()
			.sort({ createdAt: "desc" })
			.select("-adopter")
			.select("-user");
		res.status(200).json({ pets });
	}

	static async getAllUserPets(req, res) {
		const token = getToken(req);
		const user = await getUserByToken(token);

		const pets = await Pet.find({ "user._id": user._id })
			.select("-user")
			.sort({ createdAt: "desc" });
		res.status(200).json({ pets });
	}

	static async getAllUserAdoptions(req, res) {
		const token = getToken(req);
		const user = await getUserByToken(token);

		const pets = await Pet.find({ "adopter._id": user._id })
			.select("-adopter")
			.sort({ createdAt: "desc" });
		res.status(200).json({ pets });
	}

	static async getPetById(req, res) {
		const id = req.params.id;

		if (!isValidObjectId(id)) {
			res.status(422).json({ message: "ID inválido!" });
			return;
		}

		const pet = await Pet.findOne({ _id: id });

		if (!pet) {
			res.status(404).json({ message: "Pet não encontrado!" });
			return;
		}

		res.status(200).json({ pet });
	}

	static async deletePetById(req, res) {
		const id = req.params.id;

		if (!isValidObjectId(id)) {
			res.status(422).json({ message: "ID inválido!" });
			return;
		}

		const token = getToken(req);
		const user = await getUserByToken(token);

		const pet = await Pet.findOne({ _id: id });
		if (!pet) {
			res.status(404).json({ message: "Pet não encontrado!" });
			return;
		}

		if (!pet.user._id.equals(user._id)) {
			res.status(403).json({ message: "Acesso negado!" });
			return;
		}

		await Pet.deleteOne({ _id: id });

		res.status(200).json({ message: "Pet removido com sucesso!" });
	}

	static async edit(req, res) {
		const id = req.params.id;
		const { name, age, weigth, color, available } = req.body;
		const images = req.files;

		if (!isValidObjectId(id)) {
			res.status(422).json({ message: "ID inválido!" });
			return;
		}

		if (!name) {
			res.status(422).json({ message: "O NOME é obrigatório!" });
			return;
		}

		if (!age) {
			res.status(422).json({ message: "A IDADE é obrigatória!" });
			return;
		}

		if (!weigth) {
			res.status(422).json({ message: "O PESO é obrigatório!" });
			return;
		}

		if (!color) {
			res.status(422).json({ message: "A COR é obrigatória!" });
			return;
		}

		const token = getToken(req);
		const user = await getUserByToken(token);

		const pet = await Pet.findById(id);
		if (!pet) {
			res.status(404).json({ message: "Pet não encontrado!" });
			return;
		}

		if (!pet.user._id.equals(user._id)) {
			res.status(403).json({ message: "Acesso negado!" });
			return;
		}

		const updatedData = {
			name,
			age,
			weigth,
			color,
			available,
		};

		if (images.length) {
			updatedData.images = images.map((image) => {
				return { data: image.buffer, contentType: image.mimetype };
			});
		}

		try {
			await Pet.updateOne({ _id: id }, updatedData);
			res.status(200).json({ message: "Pet editado com sucesso!" });
		} catch (error) {
			res.status(500).json({ message: "Erro inesperado!", error });
			console.error("Error: " + error);
		}
	}

	static async schedule(req, res) {
		const id = req.params.id;

		const token = getToken(req);
		const user = await getUserByToken(token);

		if (!isValidObjectId(id)) {
			res.status(422).json({ message: "ID inválido!" });
			return;
		}

		const pet = await Pet.findById(id);
		if (!pet) {
			res.status(404).json({ message: "Pet não encontrado!" });
			return;
		}

		if (pet.user._id.equals(user._id)) {
			res.status(422).json({
				message: "Você não pode agendar uma visita ao seu próprio Pet!",
			});
			return;
		}

		if (user._id.equals(pet.adopter?._id)) {
			res.status(422).json({
				message: "Você já agendou uma visita para este Pet!",
			});
			return;
		}

		if (pet.adopter?._id) {
			res.status(422).json({
				message:
					"Este Pet não está aceitando visitas no momento, por favor tente mais tarde!",
			});
			return;
		}

		const isPersonRefused = pet.refused.find((person) => user._id.equals(person));
		if (isPersonRefused) {
			res.status(422).json({
				message: "Sinto muito, você não pode mais agendar uma visita a este Pet!",
			});
			return;
		}

		pet.adopter = {
			_id: user._id,
			name: user.name,
			image: user.image,
		};

		await pet.save();
		res.status(200).json({
			message: `A visita foi agendada com sucesso, entre em contato com ${pet.user.name} através do telefone: ${pet.user.phone} !`,
		});
	}

	static async concludeAdoption(req, res) {
		const id = req.params.id;

		const token = getToken(req);
		const user = await getUserByToken(token);

		if (!isValidObjectId(id)) {
			res.status(422).json({ message: "ID inválido!" });
			return;
		}

		const pet = await Pet.findById(id);
		if (!pet) {
			res.status(404).json({ message: "Pet não encontrado!" });
			return;
		}

		if (!user._id.equals(pet.user?._id)) {
			res.status(403).json({ message: "Acesso negado!" });
			return;
		}

		pet.available = false;

		await pet.save();
		res.status(200).json({
			message: "Parabéns, o ciclo de adoção foi finalizado com sucesso!",
		});
	}

	static async refuseAdopter(req, res) {
		const id = req.params.id;

		const token = getToken(req);
		const user = await getUserByToken(token);

		if (!isValidObjectId(id)) {
			res.status(422).json({ message: "ID inválido!" });
			return;
		}

		const pet = await Pet.findById(id);
		if (!pet) {
			res.status(404).json({ message: "Pet não encontrado!" });
			return;
		}

		if (!pet.user._id.equals(user._id)) {
			res.status(403).json({ message: "Acesso negado!" });
			return;
		}

		if (!pet.adopter) {
			res.status(422).json({
				message: "Não existe um adotande para você recusar!",
			});
			return;
		}

		const adopter = pet.adopter;
		pet.refused.push(adopter._id);
		pet.adopter = null;

		await pet.save();
		res.status(200).json({
			message: `Você rejeitou o adotante ${adopter.name}!`,
		});
	}
};

import { Link, useParams } from "react-router-dom";
import style from "./PetDetails.module.css";
import { useContext, useEffect, useState } from "react";
import api from "../../../../utils/api";
import useFlashMessage from "../../../../hooks/useFlashMessage";
import { UserContext } from "../../../../context/UserContext";
import { Buffer } from "buffer";
const PetDetails = () => {
	const [pet, setPet] = useState({});
	const { id } = useParams();
	const { setFlashMessage } = useFlashMessage();
	const { authenticated } = useContext(UserContext);

	useEffect(() => {
		getPet();
	}, [id]);

	const getPet = () => {
		if (id) {
			api.get(`/pet/${id}`).then(({ data }) => {
				const photos = data.pet.images.map((image) => {
					const buffer = Buffer.from(image.data).toString("base64");
					const photo = `data:${image.contentType};base64,${buffer}`;
					return photo;
				});
				data.pet.photos = photos;
				setPet(data.pet);
			});
		}
	};

	const schedule = () => {
		let message;
		let type;

		api.patch(`/pet/${pet._id}/schedule`)
			.then(({ data }) => {
				message = data.message;
				type = "success";
			})
			.catch((error) => {
				message = error.response?.data.message || "Erro inesperado!";
				type = "error";
				console.error("Error: " + error);
			})
			.finally(() => {
				setFlashMessage(message, type);
			});
	};

	return (
		<>
			{pet._id ? (
				<section className={style.pet_details_container}>
					<div className={style.pet_details_header}>
						<h1>Conhecendo o Pet: {pet.name}</h1>
						<p>Se tiver interesse, marque uma visita para conhecê-lo!</p>
					</div>
					<div className={style.pet_details_images}>
						{pet.photos.map((photo, index) => (
							<img src={photo} alt={pet.name + index} key={index} />
						))}
					</div>
					<p>
						<span className="bold">Peso: </span> {pet.weigth}kg
					</p>
					<p>
						<span className="bold">Idade: </span> {pet.age} anos
					</p>
					<p>
						<span className="bold">Cor: </span> {pet.color}
					</p>
					{authenticated ? (
						pet.available ? (
							<button onClick={schedule}>Solicitar Visita</button>
						) : (
							<p className={style.adopted_text}>Adotado</p>
						)
					) : (
						<p>
							Você precisa <Link>criar uma conta</Link> para solicitar a visita!
						</p>
					)}
				</section>
			) : (
				""
			)}
		</>
	);
};

export default PetDetails;

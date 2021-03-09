import { EventHandler } from "@atomist/skill";

import { Configuration } from "../configuration";
import { pinFromInstruction } from "../pin_from";
import { PinFromOnDockerBaseImageUpdate } from "../types";

export const handler: EventHandler<
	PinFromOnDockerBaseImageUpdate,
	Configuration
> = async ctx =>
	pinFromInstruction(
		ctx,
		ctx.data.commit,
		ctx.data.image.repository,
		ctx.data.image.manifestList?.[0]?.digest || ctx.data.image?.digest,
		ctx.data.image.tags[0],
		ctx.data.file.path,
	);

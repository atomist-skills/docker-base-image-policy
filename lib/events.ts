// eslint-disable-next-line @typescript-eslint/no-var-requires
export const pin_from_on_docker_file_on_config_change = require("./events/pin_from_on_docker_file")
	.handler;

// eslint-disable-next-line @typescript-eslint/no-var-requires
export const validate_base_images_pinned_on_config_change = require("./events/validate_base_images_pinned")
	.handler;

// eslint-disable-next-line @typescript-eslint/no-var-requires
export const validate_base_images_supported_tag_on_config_change = require("./events/validate_base_images_supported_tag")
	.handler;

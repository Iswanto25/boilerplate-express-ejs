import { Request, Response } from "express";

export const homeController = {
	home: (req: Request, res: Response) => {
		res.render("index", { title: "Home", user: req.user });
	},
};

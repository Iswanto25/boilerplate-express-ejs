import { Request, Response } from "express";

export const indexController = {
	home: (req: Request, res: Response) => {
		res.render("index", { title: "Home", user: req.user });
	}
};

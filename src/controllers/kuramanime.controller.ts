import type { Request, Response, NextFunction } from "express";
import setPayload from "@helpers/setPayload.js";
import kuramanimeConfig from "@configs/kuramanime.config.js";
import kuramanimeScraper from "@scrapers/kuramanime.scraper.js";
import kuramanimeParser from "@parsers/kuramanime.parser.js";
import kuramanimeSchema from "@schemas/kuramanime.schema.js";
import * as v from "valibot";

const { baseUrl } = kuramanimeConfig;

const allowedSort = [
  "ascending",
  "descending",
  "oldest",
  "latest",
  "popular",
  "most_viewed",
  "updated",
];

function resolveSort(sort: any, status?: string) {
  const mapped =
    sort === "a-z"
      ? "ascending"
      : sort === "z-a"
      ? "descending"
      : sort;

  if (allowedSort.includes(mapped)) return mapped;

  return status === "ongoing" ? "updated" : "latest";
}

const kuramanimeController = {
  async getRoot(req: Request, res: Response) {
    const routes = [
      { method: "GET", path: "/kuramanime/home" },
      { method: "GET", path: "/kuramanime/anime" },
      { method: "GET", path: "/kuramanime/schedule" },
      { method: "GET", path: "/kuramanime/properties/{propertyType}" },
      { method: "GET", path: "/kuramanime/properties/{propertyType}/{propertyId}" },
      { method: "GET", path: "/kuramanime/anime/{animeId}/{animeSlug}" },
      { method: "GET", path: "/kuramanime/batch/{animeId}/{animeSlug}/{batchId}" },
      { method: "GET", path: "/kuramanime/episode/{animeId}/{animeSlug}/{episodeId}" },
    ];

    res.json(
      setPayload(res, {
        message: "Status: OK 🚀",
        data: { routes },
      })
    );
  },

  async getHome(req: Request, res: Response, next: NextFunction) {
    try {
      const document = await kuramanimeScraper.scrapeDOM("/", baseUrl);

      const home = kuramanimeParser.parseHome(document);

      res.json(
        setPayload(res, {
          data: home || {},
        })
      );
    } catch (error) {
      next(error);
    }
  },

  async getAnimes(req: Request, res: Response, next: NextFunction) {
    try {
      const query = v.parse(kuramanimeSchema.query.animes, req.query);

      const status = query?.status;
      const search = query?.search || "";
      const page = Number(query?.page) || 1;

      const sort = resolveSort(query?.sort, status);

      let pathname = "";

      if (status) {
        pathname = `/quick/${
          status === "completed" ? "finished" : status
        }?order_by=${sort}&page=${page}`;
      } else if (search) {
        pathname = `/anime?order_by=${sort}&page=${page}&search=${search}`;
      } else {
        pathname = `/anime?order_by=${sort}&page=${page}`;
      }

      const document = await kuramanimeScraper.scrapeDOM(pathname, baseUrl);

      const pagination = kuramanimeParser.parsePagination(document);

      const animeList =
        status !== "ongoing"
          ? kuramanimeParser.parseAnimes(document) || []
          : undefined;

      const episodeList =
        status === "ongoing"
          ? kuramanimeParser.parseEpisodes(document) || []
          : undefined;

      res.json(
        setPayload(res, {
          data: {
            animeList,
            episodeList,
          },
          pagination,
        })
      );
    } catch (error) {
      next(error);
    }
  },

  async getProperties(req: Request, res: Response, next: NextFunction) {
    try {
      const { propertyType } = v.parse(
        kuramanimeSchema.param.properties,
        req.params
      );

      const pathname = `/properties/${propertyType}`;

      const document = await kuramanimeScraper.scrapeDOM(pathname, baseUrl);

      const propertyList = kuramanimeParser.parseProperties(document) || [];

      res.json(
        setPayload(res, {
          data: {
            propertyType,
            propertyList,
          },
        })
      );
    } catch (error) {
      next(error);
    }
  },

  async getAnimesByProperty(req: Request, res: Response, next: NextFunction) {
    try {
      const { propertyType, propertyId } = v.parse(
        kuramanimeSchema.param.animesByPropertyId,
        req.params
      );

      const query = v.parse(
        kuramanimeSchema.query.animesByPropertyId,
        req.query
      );

      const page = Number(query?.page) || 1;
      const sort = resolveSort(query?.sort);

      const pathname = `/properties/${propertyType}/${propertyId}?order_by=${sort}&page=${page}`;

      const document = await kuramanimeScraper.scrapeDOM(pathname, baseUrl);

      const animeList = kuramanimeParser.parseAnimes(document) || [];
      const pagination = kuramanimeParser.parsePagination(document);

      res.json(
        setPayload(res, {
          data: { animeList },
          pagination,
        })
      );
    } catch (error) {
      next(error);
    }
  },

  async getScheduledAnimes(req: Request, res: Response, next: NextFunction) {
    try {
      const query = v.parse(
        kuramanimeSchema.query.scheduledAnimes,
        req.query
      );

      const page = Number(query?.page) || 1;
      const day = query?.day || "all";

      const pathname = `/schedule?scheduled_day=${day}&page=${page}`;

      const document = await kuramanimeScraper.scrapeDOM(pathname, baseUrl);

      const animeList =
        kuramanimeParser.parseScheduledAnimes(document) || [];

      const pagination = kuramanimeParser.parsePagination(document);

      res.json(
        setPayload(res, {
          data: { animeList },
          pagination,
        })
      );
    } catch (error) {
      next(error);
    }
  },

  async getAnimeDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const params = v.parse(
        kuramanimeSchema.param.animeDetails,
        req.params
      );

      const pathname = `/anime/${params.animeId}/${params.animeSlug}`;

      const document = await kuramanimeScraper.scrapeDOM(pathname, baseUrl);

      const details =
        kuramanimeParser.parseAnimeDetails(document, params) || {};

      res.json(
        setPayload(res, {
          data: { details },
        })
      );
    } catch (error) {
      next(error);
    }
  },

  async getBatchDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const params = v.parse(
        kuramanimeSchema.param.batchDetails,
        req.params
      );

      const mainPathname = `/anime/${params.animeId}/${params.animeSlug}/batch/${params.batchId}`;

      const secret = await kuramanimeScraper.scrapeSecret(
        `${baseUrl}${mainPathname}`
      );

      const pathname = `${mainPathname}?Ub3BzhijicHXZdv=${secret}&C2XAPerzX1BM7V9=kuramadrive&page=1`;

      const document = await kuramanimeScraper.scrapeDOM(pathname, baseUrl);

      const details =
        kuramanimeParser.parseBatchDetails(document, params) || {};

      res.json(
        setPayload(res, {
          data: { details },
        })
      );
    } catch (error) {
      next(error);
    }
  },

  async getEpisodeDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const params = v.parse(
        kuramanimeSchema.param.episodeDetails,
        req.params
      );

      const mainPathname = `/anime/${params.animeId}/${params.animeSlug}/episode/${params.episodeId}`;

      const secret = await kuramanimeScraper.scrapeSecret(
        `${baseUrl}${mainPathname}`
      );

      const pathname = `${mainPathname}?Ub3BzhijicHXZdv=${secret}&C2XAPerzX1BM7V9=kuramadrive&page=1`;

      const document = await kuramanimeScraper.scrapeDOM(pathname, baseUrl);

      const details =
        kuramanimeParser.parseEpisodeDetails(document, params) || {};

      res.json(
        setPayload(res, {
          data: { details },
        })
      );
    } catch (error) {
      next(error);
    }
  },
};

export default kuramanimeController;

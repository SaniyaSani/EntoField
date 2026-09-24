import assert from "node:assert/strict";
import test from "node:test";
import {
  clearPreviousAutomaticPlace,
  mergeAutomaticPlace,
  placeFieldsFromNominatim,
} from "../lib/reverse-geocode.ts";

test("turns reverse-geocoded GPS data into a useful field locality", () => {
  assert.deepEqual(
    placeFieldsFromNominatim({
      name: "Universität Zürich, Campus Irchel",
      display_name:
        "Universität Zürich, Campus Irchel, Winterthurerstrasse, Zürich, Switzerland",
      address: {
        amenity: "Universität Zürich, Campus Irchel",
        city: "Zürich",
        state: "Zürich",
        country: "Switzerland",
      },
    }),
    {
      locality: "Zürich, Universität Zürich, Campus Irchel",
      region: "Zürich",
      country: "Switzerland",
    },
  );
});

test("clears stale automatic place fields when photo GPS replaces phone GPS", () => {
  const maennedorf = {
    locality: "Männedorf, Alte Landstrasse",
    region: "Zürich",
    country: "Switzerland",
  };
  assert.deepEqual(clearPreviousAutomaticPlace(maennedorf, maennedorf), {
    locality: "",
    region: "",
    country: "",
  });
});

test("keeps manually refined locality while refreshing automatic region and country", () => {
  const previous = {
    locality: "Männedorf, Alte Landstrasse",
    region: "Zürich",
    country: "Switzerland",
  };
  const current = {
    ...previous,
    locality: "Irchel butterfly meadow",
  };
  const cleared = clearPreviousAutomaticPlace(current, previous);
  assert.deepEqual(cleared, {
    locality: "Irchel butterfly meadow",
    region: "",
    country: "",
  });
  assert.deepEqual(
    mergeAutomaticPlace(
      cleared,
      {
        locality: "Zürich, Universität Zürich, Campus Irchel",
        region: "Zürich",
        country: "Switzerland",
      },
      null,
    ),
    {
      locality: "Irchel butterfly meadow",
      region: "Zürich",
      country: "Switzerland",
    },
  );
});

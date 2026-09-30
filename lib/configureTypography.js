import React from "react";
import { StyleSheet, Text, TextInput } from "react-native";
import { fontFamilyForWeight, fonts } from "@/constants/typography";

const TEXT_COMPONENTS = new Set([Text, TextInput]);

const MONO_FAMILIES = new Set([
  "monospace",
  "courier",
  "courier new",
  "menlo",
  "ui-monospace",
]);

const PRESERVE_FONT_PREFIXES = [
  "bebasneue",
  "manrope",
  "plusjakartasans",
];

function shouldSkipFontPatch(style) {
  const flat = StyleSheet.flatten(style);
  if (!flat?.fontFamily) return false;
  const family = String(flat.fontFamily).toLowerCase();
  return (
    MONO_FAMILIES.has(family)
    || family.includes("mono")
    || PRESERVE_FONT_PREFIXES.some((prefix) => family.includes(prefix))
  );
}

function typographyPatch(style) {
  if (shouldSkipFontPatch(style)) return null;

  const flat = StyleSheet.flatten(style) || {};
  const family = fontFamilyForWeight(flat.fontWeight);
  return { fontFamily: family, fontWeight: undefined };
}

function patchTextProps(props) {
  const lockScaling = {
    allowFontScaling: false,
    maxFontSizeMultiplier: 1,
  };

  if (!props) {
    return {
      ...lockScaling,
      style: { fontFamily: fonts.regular },
    };
  }

  // Always lock to app fonts — ignore OS font size / family settings
  // unless the caller explicitly opted into scaling.
  const scaling = {
    allowFontScaling:
      props.allowFontScaling === undefined ? false : props.allowFontScaling,
    maxFontSizeMultiplier:
      props.maxFontSizeMultiplier === undefined
        ? 1
        : props.maxFontSizeMultiplier,
  };

  const patch = typographyPatch(props.style);
  if (!patch) {
    if (props.style == null) {
      return {
        ...props,
        ...scaling,
        style: { fontFamily: fonts.regular },
      };
    }
    return { ...props, ...scaling };
  }

  return {
    ...props,
    ...scaling,
    style: props.style ? [patch, props.style] : patch,
  };
}

function isTextComponent(type) {
  return TEXT_COMPONENTS.has(type);
}

let configured = false;

/**
 * Apply Manrope (body) + Plus Jakarta Sans (when set explicitly) app-wide.
 * Also disables OS font scaling so device font settings cannot change the UI.
 * Uses React.createElement — Text.render patching no longer works on modern RN.
 */
export function configureTypography() {
  if (configured) return;
  configured = true;

  const originalCreateElement = React.createElement;

  React.createElement = function patchedCreateElement(type, props, ...children) {
    if (isTextComponent(type)) {
      const nextProps = patchTextProps(props);
      if (nextProps) {
        props = nextProps;
      }
    }
    return originalCreateElement.call(React, type, props, ...children);
  };
}

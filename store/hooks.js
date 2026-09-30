import { useDispatch, useSelector } from "react-redux";

/**
 * Pre-typed hooks — use these everywhere instead of plain useDispatch / useSelector.
 *
 * Usage:
 *   import { useAppDispatch, useAppSelector } from "@/store/hooks";
 *   const dispatch = useAppDispatch();
 *   const teams = useAppSelector((state) => state.team.teams);
 */
export const useAppDispatch = () => useDispatch();
export const useAppSelector = useSelector;

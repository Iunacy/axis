import { AXIS_MARK_PATH } from "@/lib/brand";

export default function Logo({ className = "size-7" }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" className={className} aria-hidden="true"><path d={AXIS_MARK_PATH} fillRule="evenodd"/></svg>;
}

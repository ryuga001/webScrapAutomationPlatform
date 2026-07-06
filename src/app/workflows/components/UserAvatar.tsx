import type { PublicUser } from "@/components/AuthProvider";

interface UserAvatarProps {
  user: PublicUser | null;
}

// Circular avatar showing the user's initial, with their email on hover.
export function UserAvatar({ user }: UserAvatarProps) {
  const initial = (user?.username?.[0] ?? "?").toUpperCase();
  return (
    <div
      title={user?.email}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container font-bold text-on-primary-container"
    >
      {initial}
    </div>
  );
}

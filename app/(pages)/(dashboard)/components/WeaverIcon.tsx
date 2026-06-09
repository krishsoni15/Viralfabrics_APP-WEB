import UserGroupIcon from '@heroicons/react/24/outline/UserGroupIcon';

interface WeaverIconProps {
  className?: string;
}

export default function WeaverIcon({ className }: WeaverIconProps) {
  return <UserGroupIcon className={className} />;
}

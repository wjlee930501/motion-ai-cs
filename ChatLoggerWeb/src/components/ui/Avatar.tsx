import React from 'react';
import clsx from 'clsx';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarStatus = 'online' | 'offline' | 'away' | 'busy';

export interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  showStatus?: boolean;
  className?: string;
  onClick?: () => void;
}

const sizeStyles: Record<AvatarSize, { container: string; text: string }> = {
  xs: { container: 'w-6 h-6', text: 'text-xs' },
  sm: { container: 'w-8 h-8', text: 'text-sm' },
  md: { container: 'w-10 h-10', text: 'text-base' },
  lg: { container: 'w-12 h-12', text: 'text-lg' },
  xl: { container: 'w-16 h-16', text: 'text-2xl' },
};

const statusStyles: Record<AvatarStatus, string> = {
  online: 'bg-green-500',
  offline: 'bg-gray-400',
  away: 'bg-yellow-500',
  busy: 'bg-red-500',
};

const statusSizeStyles: Record<AvatarSize, string> = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-4 h-4',
};

const getInitials = (name: string): string => {
  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const getColorFromName = (name: string): string => {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
  ];

  const charCode = name.charCodeAt(0);
  return colors[charCode % colors.length];
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt,
  name = 'User',
  size = 'md',
  status,
  showStatus = false,
  className,
  onClick,
}) => {
  const [imageError, setImageError] = React.useState(false);
  const initials = getInitials(name);
  const backgroundColor = getColorFromName(name);
  const showImage = src && !imageError;

  return (
    <div
      className={clsx(
        'relative inline-flex items-center justify-center flex-shrink-0',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      <div
        className={clsx(
          'rounded-full overflow-hidden flex items-center justify-center transition-all duration-200',
          sizeStyles[size].container,
          showImage ? 'bg-gray-200' : `${backgroundColor} text-white`,
          onClick && 'hover:opacity-80'
        )}
      >
        {showImage ? (
          <img
            src={src}
            alt={alt || name}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <span
            className={clsx(
              'font-semibold select-none',
              sizeStyles[size].text
            )}
          >
            {initials}
          </span>
        )}
      </div>
      {showStatus && status && (
        <span
          className={clsx(
            'absolute bottom-0 right-0 rounded-full border-2 border-white',
            statusStyles[status],
            statusSizeStyles[size]
          )}
          aria-label={status}
        />
      )}
    </div>
  );
};

export const AvatarGroup: React.FC<{
  avatars: Array<Pick<AvatarProps, 'src' | 'name' | 'alt'>>;
  size?: AvatarSize;
  max?: number;
  className?: string;
}> = ({ avatars, size = 'md', max = 5, className }) => {
  const displayAvatars = avatars.slice(0, max);
  const remaining = Math.max(0, avatars.length - max);

  return (
    <div className={clsx('flex -space-x-2', className)}>
      {displayAvatars.map((avatar, index) => (
        <div
          key={index}
          className="ring-2 ring-white rounded-full"
        >
          <Avatar {...avatar} size={size} />
        </div>
      ))}
      {remaining > 0 && (
        <div
          className={clsx(
            'rounded-full bg-gray-300 text-gray-700 flex items-center justify-center font-semibold ring-2 ring-white',
            sizeStyles[size].container,
            sizeStyles[size].text
          )}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
};

export default Avatar;

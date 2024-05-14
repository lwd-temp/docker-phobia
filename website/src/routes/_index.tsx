import { redirect, type MetaFunction } from '@remix-run/node'

export const meta: MetaFunction = () => {
    return [
        { title: 'New Remix App' },
        { name: 'description', content: 'Welcome to Remix!' },
    ]
}

export function loader() {
    if (process.env.NODE_ENV === 'development') {
        return {}
    }
    return redirect('https://github.com/remorses/docker-phobia')
}

export default function Index() {
    return <div className=''></div>
}
